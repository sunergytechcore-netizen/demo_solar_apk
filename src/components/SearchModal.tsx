import React, {useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  TouchableWithoutFeedback,
  TextInput,
  FlatList,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

const RECENT_SEARCHES = [
  {id: '1', text: 'John Doe'},
  {id: '2', text: 'Loan Application'},
  {id: '3', text: 'Bangalore Leads'},
];

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

const SearchModal: React.FC<SearchModalProps> = ({visible, onClose}) => {
  const [query, setQuery]    = useState('');
  const slideAnim            = useRef(new Animated.Value(-300)).current;
  const opacityAnim          = useRef(new Animated.Value(0)).current;
  const inputRef             = useRef<TextInput>(null);

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => inputRef.current?.focus());
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -300,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setQuery(''));
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>

      {/* Backdrop — tap to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, {opacity: opacityAnim}]} />
      </TouchableWithoutFeedback>

      {/* Panel slides down from top */}
      <Animated.View style={[styles.panel, {transform: [{translateY: slideAnim}]}]}>

        {/* Search Input Row */}
        <View style={styles.inputRow}>
          <Ionicons name="search-outline" size={18} color="#888" style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search leads, customers, reports..."
            placeholderTextColor="#aaa"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Searches — only when input is empty */}
        {query.length === 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentLabel}>Recent Searches</Text>
            <FlatList
              data={RECENT_SEARCHES}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.recentRow}
                  activeOpacity={0.7}
                  onPress={() => setQuery(item.text)}>
                  <Ionicons name="search-outline" size={18} color="#888" />
                  <Text style={styles.recentText}>{item.text}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

export default SearchModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 16,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  searchIcon: {marginRight: 8},
  input: {
    flex: 1,
    fontSize: 14,
    color: '#222',
    paddingVertical: 0,
  },
  recentSection: {paddingHorizontal: 4},
  recentLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    marginBottom: 4,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  recentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a3e',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
});