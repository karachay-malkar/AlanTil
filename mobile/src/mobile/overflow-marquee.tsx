import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { scaledTextMetrics, useTextScale } from '@/src/mobile/typography';

export function OverflowMarquee({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const textScale = useTextScale();
  const scaledMetrics = useMemo(() => scaledTextMetrics(style, textScale), [style, textScale]);
  const translateX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    translateX.stopAnimation();
    translateX.setValue(0);
    const distance = Math.ceil(textWidth - containerWidth + 12);
    if (reduceMotion || containerWidth <= 0 || distance <= 0) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(900),
      Animated.timing(translateX, {
        toValue: -distance,
        duration: Math.max(1800, distance * 28),
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.delay(700),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [containerWidth, reduceMotion, textWidth, translateX]);

  return (
    <View onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)} style={styles.clip}>
      <Animated.Text
        numberOfLines={1}
        onTextLayout={(event) => setTextWidth(event.nativeEvent.lines[0]?.width ?? 0)}
        style={[styles.text, style, scaledMetrics, { transform: [{ translateX }] }]}
      >
        {children}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { width: '100%', overflow: 'hidden' },
  text: { alignSelf: 'flex-start' },
});
