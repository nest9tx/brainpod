import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_TEXT_CHARS = 12000;
const MAX_TEXT_FILE_BYTES = 80 * 1024;
const MAX_PDF_BYTES = 2 * 1024 * 1024;

function isTextName(name: string) {
  return /\.(txt|md|csv|json|text)$/i.test(name);
}

function isPdfName(name: string) {
  return /\.pdf$/i.test(name);
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 });
  }

  const name = file.name.slice(0, 120);
  if (!name) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }

  try {
    if (isPdfName(name)) {
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json(
          { error: 'too_large', detail: 'PDF must be under 2MB for this phase.' },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      // pdf-parse is CommonJS; dynamic import keeps the route edge-safe for bundling.
      const pdfParse = (await import('pdf-parse')).default as (
        data: Buffer
      ) => Promise<{ text: string; numpages?: number }>;
      const parsed = await pdfParse(buffer);
      const text = (parsed.text ?? '').replace(/\u0000/g, '').trim();
      if (!text) {
        return NextResponse.json(
          {
            error: 'empty_pdf',
            detail:
              'No extractable text was found. Scanned image-only PDFs are not supported yet.',
          },
          { status: 400 }
        );
      }
      return NextResponse.json({
        name,
        text: text.slice(0, MAX_TEXT_CHARS),
        truncated: text.length > MAX_TEXT_CHARS,
        kind: 'pdf',
        pages: parsed.numpages ?? null,
      });
    }

    if (isTextName(name)) {
      if (file.size > MAX_TEXT_FILE_BYTES) {
        return NextResponse.json(
          { error: 'too_large', detail: 'Text attachments must be under 80KB.' },
          { status: 400 }
        );
      }
      const raw = await file.text();
      const text = raw.trim();
      if (!text) {
        return NextResponse.json({ error: 'empty_file' }, { status: 400 });
      }
      return NextResponse.json({
        name,
        text: text.slice(0, MAX_TEXT_CHARS),
        truncated: text.length > MAX_TEXT_CHARS,
        kind: 'text',
      });
    }

    return NextResponse.json(
      {
        error: 'unsupported_type',
        detail: 'Supported: .pdf, .txt, .md, .csv, .json',
      },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'parse_failed';
    return NextResponse.json({ error: 'parse_failed', detail: message }, { status: 500 });
  }
}
