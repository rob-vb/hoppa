import { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useImagePicker, ImagePickerResult, UseImagePickerOptions } from '@/hooks/use-image-picker';
import { ThemedText } from '@/components/themed-text';

type ImagePickerProps = {
  value?: ImagePickerResult | null;
  onChange?: (image: ImagePickerResult | null) => void;
  placeholder?: string;
  size?: number;
  shape?: 'circle' | 'rounded' | 'square';
  showRemoveButton?: boolean;
} & UseImagePickerOptions;

export function ImagePickerInput({
  value,
  onChange,
  placeholder = 'Add Photo',
  size = 120,
  shape = 'rounded',
  showRemoveButton = true,
  ...pickerOptions
}: ImagePickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const [showActionSheet, setShowActionSheet] = useState(false);

  const { loading, pickFromCamera, pickFromGallery } = useImagePicker(pickerOptions);

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowActionSheet(true);
  };

  const handlePickCamera = async () => {
    setShowActionSheet(false);
    const result = await pickFromCamera();
    if (result) {
      onChange?.(result);
    }
  };

  const handlePickGallery = async () => {
    setShowActionSheet(false);
    const result = await pickFromGallery();
    if (result) {
      onChange?.(result);
    }
  };

  const handleRemove = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onChange?.(null);
  };

  const handleCancel = () => {
    setShowActionSheet(false);
  };

  const getBorderRadius = () => {
    switch (shape) {
      case 'circle':
        return size / 2;
      case 'rounded':
        return 12;
      case 'square':
        return 0;
      default:
        return 12;
    }
  };

  const borderRadius = getBorderRadius();

  return (
    <>
      <View style={styles.container}>
        <Pressable
          onPress={handlePress}
          disabled={loading}
          style={({ pressed }) => [
            styles.picker,
            {
              width: size,
              height: size,
              borderRadius,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : value?.uri ? (
            <Image
              source={{ uri: value.uri }}
              style={[styles.image, { borderRadius }]}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.placeholderContent}>
              <MaterialIcons name="add-a-photo" size={32} color={colors.textSecondary} />
              <ThemedText style={[styles.placeholderText, { color: colors.textSecondary }]}>
                {placeholder}
              </ThemedText>
            </View>
          )}
        </Pressable>

        {showRemoveButton && value?.uri && (
          <Pressable
            onPress={handleRemove}
            style={({ pressed }) => [
              styles.removeButton,
              {
                backgroundColor: colors.error,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <MaterialIcons name="close" size={16} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      <ActionSheet
        visible={showActionSheet}
        onCamera={handlePickCamera}
        onGallery={handlePickGallery}
        onCancel={handleCancel}
      />
    </>
  );
}

type ActionSheetProps = {
  visible: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onCancel: () => void;
};

function ActionSheet({ visible, onCamera, onGallery, onCancel }: ActionSheetProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const handleOptionPress = (action: () => void) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    action();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <View style={styles.sheetContainer}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <ThemedText style={styles.sheetTitle}>Select Photo</ThemedText>

            <Pressable
              onPress={() => handleOptionPress(onCamera)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: pressed ? colors.border : 'transparent',
                },
              ]}
            >
              <MaterialIcons name="camera-alt" size={24} color={colors.primary} />
              <ThemedText style={[styles.optionText, { color: colors.text }]}>
                Take Photo
              </ThemedText>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable
              onPress={() => handleOptionPress(onGallery)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: pressed ? colors.border : 'transparent',
                },
              ]}
            >
              <MaterialIcons name="photo-library" size={24} color={colors.primary} />
              <ThemedText style={[styles.optionText, { color: colors.text }]}>
                Choose from Gallery
              </ThemedText>
            </Pressable>
          </View>

          <Pressable
            onPress={() => handleOptionPress(onCancel)}
            style={({ pressed }) => [
              styles.cancelButton,
              {
                backgroundColor: colors.surface,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <ThemedText style={[styles.cancelText, { color: colors.error }]}>
              Cancel
            </ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  picker: {
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '500',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    padding: 12,
    gap: 8,
  },
  sheet: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 14,
    opacity: 0.6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
  },
  optionText: {
    fontSize: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  cancelButton: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 18,
    fontWeight: '600',
  },
});
