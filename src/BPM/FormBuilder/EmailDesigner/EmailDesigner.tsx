import FormBuilder, { type FormBuilderProps } from "../FormBuilder";

export type EmailDesignerProps = Omit<FormBuilderProps, "type">;

export default function EmailDesigner(props: EmailDesignerProps) {
  return <FormBuilder {...props} type="email" />;
}
