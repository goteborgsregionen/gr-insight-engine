CREATE POLICY "Users can update analysis of their documents"
ON public.analysis_results
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM documents
  WHERE documents.id = analysis_results.document_id
    AND documents.uploaded_by = auth.uid()
));