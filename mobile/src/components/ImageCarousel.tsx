import React from 'react';
import { View, ScrollView, Image, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface ImageCarouselProps {
  images: string[];
}

export default function ImageCarousel({ images }: ImageCarouselProps) {
  if (!images || images.length === 0) {
    return <View style={styles.placeholder} />;
  }

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      style={styles.container}
    >
      {images.map((uri, index) => (
        <Image key={index} source={{ uri }} style={styles.image} resizeMode="cover" />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 300,
  },
  image: {
    width,
    height: 300,
  },
  placeholder: {
    width,
    height: 300,
    backgroundColor: '#e5e7eb',
  },
});
