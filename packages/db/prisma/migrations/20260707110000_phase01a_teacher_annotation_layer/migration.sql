-- Phase-01a: add teacherAnnotationLayer column to Submission.
-- Separate from student annotationLayer — actor isolation, append-mindset.
-- Nullable (null until a teacher first annotates a submission).
ALTER TABLE "Submission" ADD COLUMN "teacherAnnotationLayer" JSONB;
