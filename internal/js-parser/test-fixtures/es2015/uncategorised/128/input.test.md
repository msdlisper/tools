# `index.test.ts`

**DO NOT MODIFY**. This file has been autogenerated. Run `rome test internal/js-parser/index.test.ts --update-snapshots` to update.

## `es2015 > uncategorised > 128`

### `ast`

```javascript
JSRoot {
	comments: Array []
	corrupt: false
	diagnostics: Array []
	directives: Array []
	filename: "es2015/uncategorised/128/input.js"
	hasHoistedVars: false
	interpreter: undefined
	mtime: undefined
	sourceType: "script"
	syntax: Array []
	loc: Object {
		filename: "es2015/uncategorised/128/input.js"
		end: Object {
			column: 25
			line: 1
		}
		start: Object {
			column: 0
			line: 1
		}
	}
	body: Array [
		JSClassDeclaration {
			id: JSBindingIdentifier {
				name: "A"
				loc: Object {
					filename: "es2015/uncategorised/128/input.js"
					identifierName: "A"
					end: Object {
						column: 7
						line: 1
					}
					start: Object {
						column: 6
						line: 1
					}
				}
			}
			loc: Object {
				filename: "es2015/uncategorised/128/input.js"
				end: Object {
					column: 25
					line: 1
				}
				start: Object {
					column: 0
					line: 1
				}
			}
			meta: JSClassHead {
				implements: undefined
				superClass: undefined
				superTypeParameters: undefined
				typeParameters: undefined
				loc: Object {
					filename: "es2015/uncategorised/128/input.js"
					end: Object {
						column: 25
						line: 1
					}
					start: Object {
						column: 0
						line: 1
					}
				}
				body: Array [
					JSClassMethod {
						kind: "method"
						key: JSStaticPropertyKey {
							value: JSIdentifier {
								name: "foo"
								loc: Object {
									filename: "es2015/uncategorised/128/input.js"
									identifierName: "foo"
									end: Object {
										column: 19
										line: 1
									}
									start: Object {
										column: 16
										line: 1
									}
								}
							}
							loc: Object {
								filename: "es2015/uncategorised/128/input.js"
								end: Object {
									column: 19
									line: 1
								}
								start: Object {
									column: 16
									line: 1
								}
							}
						}
						loc: Object {
							filename: "es2015/uncategorised/128/input.js"
							end: Object {
								column: 24
								line: 1
							}
							start: Object {
								column: 9
								line: 1
							}
						}
						body: JSBlockStatement {
							body: Array []
							directives: Array []
							loc: Object {
								filename: "es2015/uncategorised/128/input.js"
								end: Object {
									column: 24
									line: 1
								}
								start: Object {
									column: 22
									line: 1
								}
							}
						}
						head: JSFunctionHead {
							async: false
							generator: false
							hasHoistedVars: false
							params: Array []
							rest: undefined
							returnType: undefined
							thisType: undefined
							typeParameters: undefined
							loc: Object {
								filename: "es2015/uncategorised/128/input.js"
								end: Object {
									column: 21
									line: 1
								}
								start: Object {
									column: 19
									line: 1
								}
							}
						}
						meta: JSClassPropertyMeta {
							abstract: false
							accessibility: undefined
							optional: false
							readonly: false
							static: true
							typeAnnotation: undefined
							start: Object {
								column: 9
								line: 1
							}
							loc: Object {
								filename: "es2015/uncategorised/128/input.js"
								end: Object {
									column: 19
									line: 1
								}
								start: Object {
									column: 9
									line: 1
								}
							}
						}
					}
				]
			}
		}
	]
}
```

### `diagnostics`

```
✔ No known problems!

```