import { ContentPage, contentMetadata } from '@/components/content-page';

export const generateMetadata = () => contentMetadata('about.md');

export default function Page() {
  return <ContentPage file="about.md" active="/about" />;
}
