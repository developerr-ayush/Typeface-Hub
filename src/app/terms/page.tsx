import { ContentPage, contentMetadata } from '@/components/content-page';

export const generateMetadata = () => contentMetadata('terms.md');

export default function Page() {
  return <ContentPage file="terms.md" active="/terms" />;
}
