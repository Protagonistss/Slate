// 工具定义常量
export const TOOL_NAMES = {
  // 文件操作
  READ_FILE: 'read_file',
  WRITE_FILE: 'write_file',
  LIST_DIRECTORY: 'list_directory',
  CREATE_DIRECTORY: 'create_directory',
  DELETE_FILE: 'delete_file',
  FILE_EXISTS: 'file_exists',

  // Shell 操作
  EXECUTE_SHELL: 'execute_shell',
  CHECK_COMMAND: 'check_command',
  OPEN_URL: 'open_url',

  // 编辑器操作
  GET_EDITOR_CONTENT: 'get_editor_content',
  SET_EDITOR_CONTENT: 'set_editor_content',
  INSERT_TEXT: 'insert_text',
  REPLACE_SELECTION: 'replace_selection',
  GET_SELECTION: 'get_selection',

  // HTTP 操作
  HTTP_REQUEST: 'http_request',
  HTTP_GET: 'http_get',
  HTTP_POST: 'http_post',
} as const;

// 工具分类
export const TOOL_CATEGORIES = {
  file: [
    TOOL_NAMES.READ_FILE,
    TOOL_NAMES.WRITE_FILE,
    TOOL_NAMES.LIST_DIRECTORY,
    TOOL_NAMES.CREATE_DIRECTORY,
    TOOL_NAMES.DELETE_FILE,
    TOOL_NAMES.FILE_EXISTS,
  ],
  shell: [
    TOOL_NAMES.EXECUTE_SHELL,
    TOOL_NAMES.CHECK_COMMAND,
    TOOL_NAMES.OPEN_URL,
  ],
  editor: [
    TOOL_NAMES.GET_EDITOR_CONTENT,
    TOOL_NAMES.SET_EDITOR_CONTENT,
    TOOL_NAMES.INSERT_TEXT,
    TOOL_NAMES.REPLACE_SELECTION,
    TOOL_NAMES.GET_SELECTION,
  ],
  http: [
    TOOL_NAMES.HTTP_REQUEST,
    TOOL_NAMES.HTTP_GET,
    TOOL_NAMES.HTTP_POST,
  ],
};

// 危险工具列表
export const DANGEROUS_TOOLS = [
  TOOL_NAMES.WRITE_FILE,
  TOOL_NAMES.DELETE_FILE,
  TOOL_NAMES.EXECUTE_SHELL,
  TOOL_NAMES.CREATE_DIRECTORY,
];

// 需要确认的工具
export const TOOLS_REQUIRING_CONFIRMATION = [
  TOOL_NAMES.WRITE_FILE,
  TOOL_NAMES.DELETE_FILE,
  TOOL_NAMES.CREATE_DIRECTORY,
  TOOL_NAMES.OPEN_URL,
];
