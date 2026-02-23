export interface Point {
    x: number;
    y: number;
    score: number;
}

export type HeatmapPoint = Point;
export interface TopRegion extends Point {
    imgUrl?: string;
}

export interface QueryResultPayload {
    query: string;
    results: HeatmapPoint[];
}

export interface ProcessResponseSingle {
    results: HeatmapPoint[];
    width: number;
    height: number;
}

export interface ProcessResponseMulti {
    query_results: QueryResultPayload[];
    width: number;
    height: number;
}

export type ProcessResponse = ProcessResponseSingle | ProcessResponseMulti;

export interface ServerFileObject {
    name: string;
    size_mb?: number;
}

export type ServerFileItem = string | ServerFileObject;

export interface ServerFilesResponse {
    files: ServerFileItem[];
}

export interface ParsedSlide {
    name: string;
    subname: string;
    index: string;
    fullPath: string;
    extension: string;
}

export interface SlideGroup {
    name: string;
    subgroups: Map<string, ParsedSlide[]>;
}
