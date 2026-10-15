import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "Resume file is required.",
        },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();

    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    let resumeText = "";

    // ---------------------------------------------
    // PDF
    // ---------------------------------------------

    if (fileName.endsWith(".pdf")) {
  const parser = new PDFParse({
    data: buffer,
  });

  const result = await parser.getText();

  resumeText = result.text;

  await parser.destroy();
}

    // ---------------------------------------------
    // DOCX
    // ---------------------------------------------

    else if (fileName.endsWith(".docx")) {
      const result = await mammoth.extractRawText({
        buffer,
      });

      resumeText = result.value;
    }

    // ---------------------------------------------
    // Unsupported format
    // ---------------------------------------------

    else {
      return NextResponse.json(
        {
          error:
            "Unsupported resume format. Please upload a PDF or DOCX file.",
        },
        { status: 400 }
      );
    }

    resumeText = resumeText.trim();

    if (!resumeText) {
      return NextResponse.json(
        {
          error:
            "Unable to extract text from this resume. Please upload a text-based PDF or DOCX file.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      text: resumeText,
    });
  } catch (error) {
    console.error(
      "RESUME EXTRACTION ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to extract resume text.",
      },
      { status: 500 }
    );
  }
}