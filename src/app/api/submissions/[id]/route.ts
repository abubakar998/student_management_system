import { NextResponse } from "next/server";

import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { assertCanReadStudent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { MissingFileError, readSubmissionFile } from "@/lib/storage";

/**
 * Download a submitted file.
 *
 * Files live outside `public/` precisely so that this check runs first: staff
 * may read any submission, a student only their own. Serving them statically
 * would make every file readable by anyone who learned its name.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const submission = await prisma.submission.findUnique({
      where: { id },
      select: { storedName: true, originalName: true, mimeType: true, studentId: true },
    });

    if (!submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Throws unless the caller is staff or the owning student.
    await assertCanReadStudent(submission.studentId);

    const buffer = await readSubmissionFile(submission.storedName);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": submission.mimeType,
        // `attachment` stops a PDF rendering inline in a context where its
        // scripts would run against our origin.
        "Content-Disposition": `attachment; filename="${encodeURIComponent(submission.originalName)}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Sign in to download this file." }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof MissingFileError) {
      // The record exists but its bytes are gone — reported as not-found rather
      // than as a server fault, and logged so it can be chased up.
      console.warn(error.message);
      return NextResponse.json({ error: "That file is no longer available." }, { status: 404 });
    }
    console.error("Submission download failed:", error);
    return NextResponse.json({ error: "Could not read that file." }, { status: 500 });
  }
}
