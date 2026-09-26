import { ContentPage, contentMetadata } from '@/components/content-page';

export const generateMetadata = () => contentMetadata('privacy.md');

export default function Page() {
  return <ContentPage file="privacy.md" active="/privacy" />;
}
