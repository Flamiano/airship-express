// redirect /gallery to /documents as gallery view is integrated into documents
import { redirect } from 'next/navigation';

export default function GalleryPage() {
    redirect('/documents');
}
