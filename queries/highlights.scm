; Highlight queries for ClickHouse grammar

; Data types - primitive
(primitive_type) @type.builtin

; Data types - complex type keywords
[
  "Array"
  "Tuple"
  "Map"
  "Nested"
  "Nullable"
] @type.builtin

; Engine names
(engine_name) @type.builtin

; String literals
(string_literal) @string

; Numbers
(number) @number

; Comments
(comment) @comment

; Identifiers
(identifier) @variable

; Function calls - first child is the identifier (function name)
(function_call
  . (identifier) @function)

; Unary operators (operator is the first child)
(unary_expression
  . (_) @operator)

; Punctuation - match only what exists in the grammar
"(" @punctuation.bracket
")" @punctuation.bracket
"[" @punctuation.bracket
"]" @punctuation.bracket
"," @punctuation.delimiter
"." @punctuation.delimiter
"=" @punctuation.delimiter

; Table and column names in CREATE TABLE
(qualified_table_name
  (identifier) @variable)

; Column definition: first child is the identifier (column name)
(column_definition
  . (identifier) @variable)

; Type in column definition
(column_definition
  (primitive_type) @type)
(column_definition
  (complex_type) @type)

; Type names in complex types
(complex_type
  (primitive_type) @type)
(complex_type
  (complex_type) @type)

; SELECT statement specific
; Wildcard in SELECT
(wildcard) @operator

; Table names in FROM clause
(from_clause
  (identifier) @variable)

; Column aliases
(aliased_expression
  . (_)
  . (identifier) @variable.member)
