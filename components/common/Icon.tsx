import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export { Ionicons, MaterialCommunityIcons, MaterialIcons };

export type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
export type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
