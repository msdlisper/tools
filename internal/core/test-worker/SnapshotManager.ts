/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
	AbsoluteFilePath,
	AbsoluteFilePathMap,
	RelativeFilePath,
} from "@internal/path";
import {exists, readFileText} from "@internal/fs";
import {TestServerRunnerOptions} from "../server/testing/types";
import TestWorkerFile from "./TestWorkerFile";
import {descriptions} from "@internal/diagnostics";
import {createSnapshotParser, parseSnapshot} from "./SnapshotParser";
import {ErrorFrame} from "@internal/v8";
import {Number0, Number1} from "@internal/ob1";
import {prettyFormatToString} from "@internal/pretty-format";
import {FilePathLocker} from "../../async/lockers";
import {naturalCompare} from "@internal/string-utils";
import {ExtendedMap} from "@internal/collections";

function cleanHeading(key: string): string {
	if (key[0] === "`") {
		key = key.slice(1);
	}

	if (key[key.length - 1] === "`") {
		key = key.slice(0, -1);
	}

	return key.trim();
}

export type SnapshotEntry = {
	testName: string;
	entryName: string;
	language: undefined | string;
	value: string;
	used: boolean;
};

export type Snapshot = {
	existsOnDisk: boolean;
	used: boolean;
	raw: string;
	entries: Map<string, SnapshotEntry>;
};

export const SNAPSHOT_EXT = ".test.md";

function buildEntriesKey(testName: string, entryName: string): string {
	return `${testName}#${entryName}`;
}

export type InlineSnapshotUpdate = {
	line: Number1;
	column: Number0;
	snapshot: boolean | number | string | null;
};

export type InlineSnapshotUpdates = Array<InlineSnapshotUpdate>;

function stringOrPrettyFormat(value: unknown): string {
	if (typeof value === "string") {
		return value;
	} else {
		return prettyFormatToString(value);
	}
}

export default class SnapshotManager {
	constructor(runner: TestWorkerFile, testPath: AbsoluteFilePath) {
		this.defaultSnapshotPath = testPath.getParent().append(
			`${testPath.getExtensionlessBasename()}${SNAPSHOT_EXT}`,
		);
		this.runner = runner;
		this.options = runner.globalOptions;
		this.snapshots = new AbsoluteFilePathMap();
		this.fileLocker = new FilePathLocker();
		this.inlineSnapshotsUpdates = [];
	}

	public inlineSnapshotsUpdates: Array<InlineSnapshotUpdate>;
	public snapshots: AbsoluteFilePathMap<Snapshot>;
	private defaultSnapshotPath: AbsoluteFilePath;
	private fileLocker: FilePathLocker;
	private runner: TestWorkerFile;
	private options: TestServerRunnerOptions;

	public static buildSnapshot(
		{entries, absolute, relative}: {
			absolute: AbsoluteFilePath;
			relative: RelativeFilePath;
			entries: Iterable<SnapshotEntry>;
		},
	): string {
		// Build the snapshot
		let lines: Array<string> = [];

		function pushNewline() {
			if (lines[lines.length - 1] !== "") {
				lines.push("");
			}
		}

		lines.push(`# \`${absolute.getBasename()}\``);
		pushNewline();
		lines.push(
			`**DO NOT MODIFY**. This file has been autogenerated. Run \`rome test ${relative.join()} --update-snapshots\` to update.`,
		);
		pushNewline();

		const testNameToEntries: ExtendedMap<string, Map<string, SnapshotEntry>> = new ExtendedMap(
			"testNameToEntries",
			() => new Map(),
		);
		for (const entry of entries) {
			if (!entry.used) {
				continue;
			}
			let entriesByTestName = testNameToEntries.assert(entry.testName);
			entriesByTestName.set(entry.entryName, entry);
		}

		// Get test names and sort them so they are in a predictable
		const testNames = Array.from(testNameToEntries.keys()).sort();

		for (const testName of testNames) {
			const entries = testNameToEntries.get(testName)!;

			lines.push(`## \`${testName}\``);
			pushNewline();
			const entryNames = Array.from(entries.keys()).sort(naturalCompare);

			for (const snapshotName of entryNames) {
				const entry = entries.get(snapshotName)!;

				const {value} = entry;
				const language = entry.language === undefined ? "" : entry.language;

				// If the test only has one snapshot then omit the heading
				const skipHeading = snapshotName === "0" && entryNames.length === 1;
				if (!skipHeading) {
					lines.push(`### \`${snapshotName}\``);
				}

				pushNewline();
				lines.push("```" + language);
				// TODO escape triple backquotes
				lines.push(value);
				lines.push("```");
				pushNewline();
			}
		}
		return lines.join("\n");
	}

	public getModifiedSnapshots(): AbsoluteFilePathMap<Snapshot> {
		const snapshots: AbsoluteFilePathMap<Snapshot> = new AbsoluteFilePathMap();

		for (const [name, snapshot] of this.snapshots) {
			let filteredEntries = snapshot.entries;

			// If we are a partial runner, then filter all unused entries as they'll be dispatched by the dedicated runner
			if (!this.runner.options.partial) {
				filteredEntries = new Map(snapshot.entries);
				for (const [name, entry] of filteredEntries) {
					if (!entry.used) {
						filteredEntries.delete(name);
					}
				}
			}

			snapshots.set(
				name,
				{
					...snapshot,
					entries: filteredEntries,
				},
			);
		}

		return snapshots;
	}

	public normalizeSnapshotPath(filename: undefined | string): AbsoluteFilePath {
		if (filename === undefined) {
			return this.defaultSnapshotPath;
		}

		const path = this.runner.path.getParent().resolve(filename);
		const ext = path.getExtensions();
		if (ext.endsWith(SNAPSHOT_EXT)) {
			return path;
		} else {
			return path.addExtension(SNAPSHOT_EXT);
		}
	}

	public async init() {
		await this.loadSnapshot(this.defaultSnapshotPath);
	}

	private async loadSnapshot(
		path: AbsoluteFilePath,
	): Promise<undefined | Snapshot> {
		if (!(await exists(path))) {
			return;
		}

		return this.fileLocker.wrapLock(
			path,
			async () => {
				const loadedSnapshot = this.snapshots.get(path);
				if (loadedSnapshot !== undefined) {
					return loadedSnapshot;
				}

				const content = await readFileText(path);
				const parser = createSnapshotParser({
					path,
					input: content,
				});
				const nodes = parseSnapshot(parser);

				const snapshot: Snapshot = {
					existsOnDisk: true,
					used: false,
					raw: parser.input,
					entries: new Map(),
				};
				this.snapshots.set(path, snapshot);

				while (nodes.length > 0) {
					const node = nodes.shift()!;

					if (node.type === "Heading" && node.level === 1) {
						// Title
						continue;
					}

					if (node.type === "Heading" && node.level === 2) {
						const testName = cleanHeading(node.text);

						while (nodes.length > 0) {
							const node = nodes[0];

							if (node.type === "Heading" && node.level === 3) {
								nodes.shift();

								const entryName = cleanHeading(node.text);

								const codeBlock = nodes.shift();
								if (codeBlock === undefined || codeBlock.type !== "CodeBlock") {
									throw parser.unexpected({
										description: descriptions.SNAPSHOTS.EXPECTED_CODE_BLOCK_AFTER_HEADING,
										loc: node.loc,
									});
								}

								snapshot.entries.set(
									buildEntriesKey(testName, entryName),
									{
										testName,
										entryName,
										language: codeBlock.language,
										value: codeBlock.text,
										used: false,
									},
								);

								continue;
							}

							if (node.type === "CodeBlock") {
								nodes.shift();

								snapshot.entries.set(
									buildEntriesKey(testName, "0"),
									{
										testName,
										entryName: "0",
										language: node.language,
										value: node.text,
										used: false,
									},
								);
							}

							break;
						}
					}
				}
				return snapshot;
			},
		);
	}

	public testInlineSnapshot(
		callFrame: ErrorFrame,
		received: unknown,
		expected?: InlineSnapshotUpdate["snapshot"],
	): {
		status: "MATCH" | "NO_MATCH" | "UPDATE";
	} {
		let receivedFormat = stringOrPrettyFormat(received);
		let expectedFormat = stringOrPrettyFormat(expected);

		// Matches, no need to do anything
		if (receivedFormat === expectedFormat) {
			return {status: "MATCH"};
		}

		const shouldSave = this.options.updateSnapshots || expected === undefined;
		if (shouldSave) {
			const {lineNumber, columnNumber} = callFrame;
			if (lineNumber === undefined || columnNumber === undefined) {
				throw new Error("Call frame has no line or column");
			}

			if (!this.options.freezeSnapshots) {
				let snapshot: InlineSnapshotUpdate["snapshot"] = receivedFormat;
				if (
					typeof received === "string" ||
					typeof received === "number" ||
					typeof received === "boolean" ||
					received === null
				) {
					snapshot = received;
				}

				this.inlineSnapshotsUpdates.push({
					line: lineNumber,
					column: columnNumber,
					snapshot,
				});
			}

			return {status: "UPDATE"};
		}

		return {status: "NO_MATCH"};
	}

	public async get(
		testName: string,
		entryName: string,
		optionalFilename: undefined | string,
	): Promise<undefined | string> {
		const snapshotPath = this.normalizeSnapshotPath(optionalFilename);
		let snapshot = this.snapshots.get(snapshotPath);

		if (snapshot === undefined) {
			snapshot = await this.loadSnapshot(snapshotPath);
		}

		if (snapshot === undefined) {
			return undefined;
		}

		snapshot.used = true;

		// If we're force updating, pretend that there was no entry
		if (this.options.updateSnapshots) {
			return undefined;
		}

		const entry = snapshot.entries.get(buildEntriesKey(testName, entryName));
		if (entry === undefined) {
			return undefined;
		} else {
			entry.used = true;
			return entry.value;
		}
	}

	public set(
		{
			testName,
			entryName,
			value,
			language,
			optionalFilename,
		}: {
			testName: string;
			entryName: string;
			value: string;
			language: undefined | string;
			optionalFilename: undefined | string;
		},
	) {
		const snapshotPath = this.normalizeSnapshotPath(optionalFilename);
		let snapshot = this.snapshots.get(snapshotPath);
		if (snapshot === undefined) {
			snapshot = {
				raw: "",
				existsOnDisk: false,
				used: true,
				entries: new Map(),
			};
			this.snapshots.set(snapshotPath, snapshot);
		}

		snapshot.entries.set(
			buildEntriesKey(testName, entryName),
			{
				testName,
				entryName,
				language,
				value,
				used: true,
			},
		);
	}
}