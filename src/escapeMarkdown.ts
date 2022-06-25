export function escapeMarkdown(markdown: string): string {
    return markdown.replace(/([_*[\]()~`>#+-=|{}.!])/g, '\\$1');
}
