export function trim(text: string, val: string) {
    let start = 0;
    let end = text.length;

    while (start < end && text[start] === val) ++start;

    while (end > start && text[end - 1] === val) --end;

    return (start > 0 || end < text.length) ? text.substring(start, end) : text;
}