import FormBuilder, { type FormBuilderProps } from "../FormBuilder";

export type PdfDesignerProps = Omit<FormBuilderProps, "type"> & {
  onExportPdf?: (pdfBytes: Uint8Array) => void;
};

export default function PdfDesigner({ onExportPdf: _onExportPdf, ...props }: PdfDesignerProps) {
  return <FormBuilder {...props} type="pdf" />;
}
