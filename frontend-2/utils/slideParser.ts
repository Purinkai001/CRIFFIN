import type { ParsedSlide, SlideGroup } from "@/lib/types";

export function parseSlideFileName(filename: string): ParsedSlide {
    const extension = filename.split('.').pop() || '';
    const baseName = filename.replace(/\.(mrxs|svs|ndpi)$/i, '');
    const parts = baseName.split(',');
    return {
        name: parts[0] || baseName,
        subname: parts[1] || '',
        index: parts[2] || '',
        fullPath: filename,
        extension: extension.toUpperCase(),
    };
}

export function groupSlides(slides: string[]): SlideGroup[] {
    const groups = new Map<string, Map<string, ParsedSlide[]>>();
    slides.forEach(filename => {
        const parsed = parseSlideFileName(filename);
        if (!groups.has(parsed.name)) groups.set(parsed.name, new Map());
        const nameGroup = groups.get(parsed.name)!;
        if (!nameGroup.has(parsed.subname)) nameGroup.set(parsed.subname, []);
        nameGroup.get(parsed.subname)!.push(parsed);
    });

    const result: SlideGroup[] = [];
    for (const name of Array.from(groups.keys()).sort()) {
        const subgroups = groups.get(name)!;
        subgroups.forEach((slides) => {
            slides.sort((a, b) => a.index.localeCompare(b.index, undefined, { numeric: true }));
        });
        result.push({ name, subgroups });
    }
    return result;
}

export function countSelectedInGroup(group: SlideGroup, selectedSlides: string[]): number {
    let count = 0;
    group.subgroups.forEach(slides => {
        count += slides.filter(s => selectedSlides.includes(s.fullPath)).length;
    });
    return count;
}

export function countSelectedInSubgroup(slides: ParsedSlide[], selectedSlides: string[]): number {
    return slides.filter(s => selectedSlides.includes(s.fullPath)).length;
}

export function countTotalInGroup(group: SlideGroup): number {
    let count = 0;
    group.subgroups.forEach(slides => { count += slides.length; });
    return count;
}
