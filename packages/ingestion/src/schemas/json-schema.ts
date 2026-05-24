export interface JsonSchema {
    type?: string | string[];
    description?: string;
    required?: string[];
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    enum?: readonly string[];
    additionalProperties?: boolean;
}
