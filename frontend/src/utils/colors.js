import { PALETTE } from "../constants";

export function subjectColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) {
        h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
    }
    return PALETTE[Math.abs(h) % PALETTE.length];
}
