import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';

export type ImagePickerResult = {
  uri: string;
  width: number;
  height: number;
  type?: string;
  fileName?: string;
  fileSize?: number;
};

export type UseImagePickerOptions = {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
};

export function useImagePicker(options: UseImagePickerOptions = {}) {
  const { allowsEditing = true, aspect = [1, 1], quality = 0.8 } = options;
  const [image, setImage] = useState<ImagePickerResult | null>(null);
  const [loading, setLoading] = useState(false);

  const requestCameraPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera access in your device settings to take photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  }, []);

  const requestMediaLibraryPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'Please enable photo library access in your device settings to select photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  }, []);

  const pickFromCamera = useCallback(async (): Promise<ImagePickerResult | null> => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return null;

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing,
        aspect,
        quality,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const imageResult: ImagePickerResult = {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          type: asset.mimeType,
          fileName: asset.fileName ?? undefined,
          fileSize: asset.fileSize ?? undefined,
        };
        setImage(imageResult);
        return imageResult;
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [allowsEditing, aspect, quality, requestCameraPermission]);

  const pickFromGallery = useCallback(async (): Promise<ImagePickerResult | null> => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return null;

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing,
        aspect,
        quality,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const imageResult: ImagePickerResult = {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          type: asset.mimeType,
          fileName: asset.fileName ?? undefined,
          fileSize: asset.fileSize ?? undefined,
        };
        setImage(imageResult);
        return imageResult;
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [allowsEditing, aspect, quality, requestMediaLibraryPermission]);

  const clearImage = useCallback(() => {
    setImage(null);
  }, []);

  return {
    image,
    loading,
    pickFromCamera,
    pickFromGallery,
    clearImage,
    setImage,
  };
}
