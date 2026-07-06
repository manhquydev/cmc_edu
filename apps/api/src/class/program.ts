// Program catalog (docs/19 SS1, Prisma `Program` enum). Single source for the
// zod validator shared by course.create and classBatch.create's derived
// program field.

export const PROGRAM_VALUES = ['UCREA', 'BRIGHT_IG', 'BLACK_HOLE'] as const;

export type ProgramValue = (typeof PROGRAM_VALUES)[number];
