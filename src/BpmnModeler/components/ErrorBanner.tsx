import { useTranslation } from "react-i18next";

type ErrorBannerProps = {
  message: string;
};

export default function ErrorBanner({ message }: ErrorBannerProps) {
  const { t } = useTranslation("bpmn");
  return <div className="bpmn-error">{t("error", { message })}</div>;
}
