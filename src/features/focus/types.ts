export type FocusSession = {
    id: string;
    couple_id: string;
    started_by: string;
    started_at: string;
    work_sec: number;
    break_sec: number;
    cycles: number;
    status: 'active' | 'finished' | 'cancelled';
    label: string;
};
export type FocusLog = {
    id: string;
    couple_id: string;
    user_id: string;
    session_id: string;
    completed_cycles: number;
    minutes: number;
    day: string;
};
export type Plant = {
    id: string;
    couple_id: string;
    species: 'daisy' | 'tulip' | 'pine' | 'blossom';
    grown_at: string;
    session_id: string;
    x: number;
    y: number;
};
