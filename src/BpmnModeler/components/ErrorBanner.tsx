type ErrorBannerProps = {
  message: string;
};

export default function ErrorBanner({ message }: ErrorBannerProps) {
  return <div className="bpmn-error">Failed to render diagram: {message}</div>;
}
