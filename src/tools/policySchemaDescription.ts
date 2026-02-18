/**
 * Shared policy schema description for MCP tool parameter documentation.
 * This gives the LLM the exact JSON format the backend expects.
 */
export const POLICY_SCHEMA_DESCRIPTION = `Full policy specification object. Must follow this exact JSON structure:

{
  "id": "<namespace>.<category>.<name>",        // e.g. "bind.finance.creditCheck"
  "version": "0.1.0",                           // semver
  "metadata": {
    "title": "Human-readable title",
    "description": "What this policy verifies",
    "category": "finance|mobility|identity|demo|...",
    "namespace": "your-org-name"          // MUST match your org's slugified name
  },
  "subject": {
    "type": "individual|organization|vehicle|device",
    "identifier": "wallet_address|did|vin|..."
  },

  "inputs": [                                    // Data inputs for the circuit
    {
      "id": "input_name",                        // snake_case identifier, used in rule expressions
      "source": { "kind": "static|api", "api": "optional_api_name" },
      "signal": "input_name",                    // typically matches id
      "valueType": "number|boolean|string",      // ZK circuits only support number/boolean natively
      "unit": "optional_unit",                   // e.g. "USD", "count", "months"
      "time": { "mode": "point|range|relative", "lookback": "30d" },
      "aggregation": { "op": "latest|sum|mean|count" },
      "encoding": {                              // REQUIRED for string inputs (ZK circuits need numbers)
        "type": "enum",
        "values": { "label1": 1, "label2": 2 }  // maps string values to numeric codes
      }
    }
  ],

  "rules": [                                     // Constraints and scoring conditions
    {
      "id": "rule_name",
      "description": "Human-readable description",
      "assert": <expression>,                    // see expression types below
      "severity": "fail|warn|info"               // fail = hard constraint, warn = scoring input
    }
  ],

  "evaluation": {
    "kind": "PASS_FAIL|SCORE",
    // For SCORE:
    "scoreRange": { "min": 0, "max": 100 },
    "baseline": 50,
    "contributions": [
      { "ruleId": "rule_name", "points": 30, "whenPasses": true }
    ]
    // For PASS_FAIL: no extra fields needed
  },

  "outputs": [
    {
      "name": "output_name",
      "type": "boolean|enum|number",
      "derive": {
        "kind": "PASS_FAIL|SCORE|BAND|CONST",
        "from": "SCORE|input_id",               // for SCORE/BAND
        "bands": [                               // for BAND only
          { "label": "low", "minInclusive": 0, "maxExclusive": 40 },
          { "label": "high", "minInclusive": 40, "maxExclusive": 101 }
        ],
        "value": 42                              // for CONST only
      },
      "disclosed": true
    }
  ],

  "validity": { "ttl": "P30D" },                // ISO 8601 duration
  "disclosure": {
    "default": "SELECTIVE",
    "exposeClaims": ["output_name"]
  },

  "proving": {
    "circuitId": "<namespace>.<name>.v<version>", // e.g. "bind.finance.credit_check.v0_1_0"
    "inputTypes": { "input_name": "u32" },        // Noir types: u8|u16|u32|u64|i8|i16|i32|i64|bool|Field
    "outputType": "u8"                            // single-output Noir return type
  }
}

EXPRESSION TYPES (used in rules[].assert):

  ref:   { "type": "ref", "inputId": "<input_id>" }
  const: { "type": "const", "value": <number|boolean> }
  cmp:   { "type": "cmp", "cmp": ">=|<=|>|<|==|!=", "left": <expr>, "right": <expr> }
  op:    { "type": "op", "op": "+|-|*|/", "args": [<expr>, <expr>, ...] }
  and:   { "type": "and", "args": [<expr>, <expr>, ...] }
  or:    { "type": "or", "args": [<expr>, <expr>, ...] }
  not:   { "type": "not", "arg": <expr> }

IMPORTANT NOTES:
- Expression field names: use "inputId" (not "path"), "cmp" (not "operator"), "args" (not "children"), "arg" (not "expr")
- const values must be numbers or booleans, never strings
- String inputs MUST have an "encoding" field with type "enum" and a values map (ZK circuits only work with numbers)
- If a string input has encoding, the circuit will use u32 by default (override via proving.inputTypes)
- Use proving.inputTypes to override default Noir types when needed (e.g. u64 for large numbers)
- metadata.namespace must start with your organization's name (e.g., "myorg" or "myorg.finance"). Sub-namespaces are allowed. The "bind" and "system" namespaces are reserved.
- The policy id must start with the namespace (e.g., "myorg.finance.creditCheck" for namespace "myorg.finance")`;
