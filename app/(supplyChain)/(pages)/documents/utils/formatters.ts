// formatting and styling helpers for file types, file sizes, and activity badges

export const getFileIcon = (fileType?: string | null) => {
    const type = (fileType || '').toLowerCase();
    if (type.includes('pdf')) return 'fa-file-pdf text-red-500';
    if (type.includes('jpg') || type.includes('jpeg') || type.includes('png') || type.includes('heic') || type.includes('webp') || type.includes('image')) {
        return 'fa-file-image text-blue-500';
    }
    if (type.includes('doc') || type.includes('docx') || type.includes('word')) return 'fa-file-word text-blue-600';
    if (type.includes('xls') || type.includes('xlsx') || type.includes('sheet') || type.includes('excel') || type.includes('csv')) return 'fa-file-excel text-green-600';
    return 'fa-file text-slate-500 dark:text-slate-400';
};

export const getFileColor = (fileType?: string | null) => {
    const type = (fileType || '').toLowerCase();
    if (type.includes('pdf')) return 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-800/30 text-red-600 dark:text-red-400';
    if (type.includes('jpg') || type.includes('jpeg') || type.includes('png') || type.includes('heic') || type.includes('webp') || type.includes('image')) {
        return 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-800/30 text-blue-600 dark:text-blue-400';
    }
    if (type.includes('doc') || type.includes('docx') || type.includes('word')) return 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-800/30 text-blue-600 dark:text-blue-400';
    if (type.includes('xls') || type.includes('xlsx') || type.includes('sheet') || type.includes('excel') || type.includes('csv')) return 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-800/30 text-green-600 dark:text-green-400';
    return 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-700/30 text-slate-600 dark:text-slate-400';
};

export const formatFileSize = (bytes?: number | null) => {
    if (bytes == null || isNaN(Number(bytes)) || Number(bytes) <= 0) return '0 B';
    const numBytes = Number(bytes);
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(numBytes) / Math.log(k)), sizes.length - 1);
    if (i < 0) return '0 B';
    return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getActionIcon = (action: string) => {
    switch (action) {
        case 'upload': return 'fa-upload';
        case 'update': return 'fa-edit';
        case 'delete': return 'fa-trash';
        default: return 'fa-circle';
    }
};

export const getActionColor = (action: string) => {
    switch (action) {
        case 'upload': return 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-200/80 dark:border-pink-800/50 shadow-2xs';
        case 'update': return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/50 shadow-2xs';
        case 'delete': return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/50 shadow-2xs';
        default: return 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs';
    }
};
