-- Keep the existing HR1 resumes bucket private while allowing optional
-- applicant ID and education files to be stored in it.
update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ]
where id = 'resumes';
