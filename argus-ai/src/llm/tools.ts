
export interface Tool {
  name: string;
  description: string;
  parameters: object;
}

export const availableTools: Tool[] = [
  {
    name: 'get_current_time',
    description: 'Returns the current time.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  // Add more tools here as needed
];

export function executeTool(toolName: string, args: any) {
  switch (toolName) {
    case 'get_current_time':
      return new Date().toISOString();
    default:
      throw new Error();
  }
}
