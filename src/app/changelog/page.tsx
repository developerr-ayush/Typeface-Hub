import { ContentPage, contentMetadata } from '@/components/content-page';

export const generateMetadata = () => contentMetadata('changelog.md');

export default function Page() {
  return <ContentPage file="changelog.md" active="/changelog" />;
}
