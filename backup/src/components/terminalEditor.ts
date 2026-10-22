const EDITOR_COMMAND = /^(?:sudo\s+)?(?:nano|vim|vi|nvim)\s+(?:-\S+\s+)*([\w./-]+\.py)\s*$/;
const SAFE_NAME = /^[\w./-]{1,200}$/;

export function editorCommandFile(command: string): string | null {
  const match = command.trim().match(EDITOR_COMMAND);
  return match && isSafeFilename(match[1]) ? match[1] : null;
}

export function isSafeFilename(name: string): boolean {
  return SAFE_NAME.test(name) && !name.split('/').includes('..') && !name.startsWith('-');
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToUtf8(data: string): string {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function loadCommand(file: string): string {
  return ` printf '__CR_B64__%s__CR_END__\\n' "$(base64 -w0 -- '${file}' 2>/dev/null)"\r`;
}

export function parseLoadOutput(output: string): string | null {
  const match = output.match(/__CR_B64__([A-Za-z0-9+/=]*)__CR_END__/);
  return match ? base64ToUtf8(match[1]) : null;
}

export function saveCommands(file: string, text: string, tag: string): string[] {
  const tmp = `/tmp/.cr_edit_${tag}.b64`;
  const data = utf8ToBase64(text);
  const lines = [` : > ${tmp}\r`];
  for (let i = 0; i < data.length; i += 2000) {
    lines.push(` printf '%s' '${data.slice(i, i + 2000)}' >> ${tmp}\r`);
  }
  lines.push(` base64 -d ${tmp} > '${file}' && rm -f ${tmp} && printf '__CR_%s__\\n' SAVED || printf '__CR_%s__\\n' FAILED\r`);
  return lines;
}

export function parseSaveOutput(output: string): 'saved' | 'failed' | null {
  if (output.includes('__CR_SAVED__')) return 'saved';
  if (output.includes('__CR_FAILED__')) return 'failed';
  return null;
}

function draftKey(labId: string, file: string): string {
  return `cr-editor-draft:${labId}:${file}`;
}

export function readDraft(labId: string, file: string): string | null {
  try {
    return window.localStorage.getItem(draftKey(labId, file));
  } catch {
    return null;
  }
}

export function writeDraft(labId: string, file: string, text: string): boolean {
  try {
    window.localStorage.setItem(draftKey(labId, file), text);
    return true;
  } catch {
    return false;
  }
}

export function tidyIndentation(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((line) => {
    const lead = line.match(/^[ \t]*/)?.[0] ?? '';
    return (lead.replace(/\t/g, '    ') + line.slice(lead.length)).replace(/[ \t]+$/, '');
  });
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}
