import prisma from '../../utils/prisma.js';
import { ExecutionContext, ActionResult, replacePlaceholders, getClientData } from './types.js';

interface NoteActionConfig {
  text?: string;
  templateId?: string;
  tags?: string[];
  isPinned?: boolean;
}

export async function executeCreateNote(
  config: NoteActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    let text = config.text;
    let templateName = '';

    if (config.templateId) {
      const template = await prisma.noteTemplate.findUnique({ where: { id: config.templateId } });
      if (!template) return { success: false, message: `Note template not found: ${config.templateId}` };
      templateName = template.name;
      text = template.content || text;
    }

    if (!text) return { success: false, message: 'Note text is required (either provide text or templateId)' };

    const client = await getClientData(context.clientId);
    const placeholderContext = { ...context, clientData: client };
    const finalText = replacePlaceholders(text, placeholderContext);
    const tags = config.tags || [];

    const note = await prisma.note.create({
      data: { clientId: context.clientId, text: finalText, tags: JSON.stringify(tags), isPinned: config.isPinned || false, createdById: context.userId },
    });

    await prisma.activity.create({
      data: {
        clientId: context.clientId, userId: context.userId, type: 'NOTE_ADDED',
        description: `Note created via workflow${templateName ? ` from template: ${templateName}` : ''}`,
        metadata: JSON.stringify({ noteId: note.id, templateName, tags, isPinned: note.isPinned }),
      },
    });

    return { success: true, message: 'Note created successfully', data: { noteId: note.id, text: finalText, tags, isPinned: note.isPinned, templateName } };
  } catch (error) {
    console.error('Error executing CREATE_NOTE action:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Failed to create note' };
  }
}

export async function executeNoteAction(
  actionType: string,
  config: NoteActionConfig,
  context: ExecutionContext
): Promise<ActionResult> {
  switch (actionType) {
    case 'CREATE_NOTE': return executeCreateNote(config, context);
    default: return { success: false, message: `Unknown note action type: ${actionType}` };
  }
}
