import { Redirect } from 'expo-router';

export default function FavoritesStudyRoute() {
  return <Redirect href={{ pathname: '/path/learn', params: { source: 'favorites' } }} />;
}
