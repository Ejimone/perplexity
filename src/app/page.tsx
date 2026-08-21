import HomeViews from '@/components/HomeViews';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat - Curiocity',
  description: 'Chat with the internet, chat with Curiocity.',
};

const Home = () => {
  return <HomeViews />;
};

export default Home;
