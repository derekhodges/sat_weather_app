import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  Modal,
} from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const COLORS = [
  { name: 'Red', value: '#FF0000' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Green', value: '#00FF00' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Orange', value: '#FF8800' },
];

export const DrawingOverlay = ({ externalColorPicker, setExternalColorPicker }) => {
  const {
    isDrawingMode,
    drawingColor,
    setDrawingColor,
    drawings,
    addDrawing,
    clearDrawings,
  } = useApp();

  const [currentPath, setCurrentPath] = useState([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const pathRef = useRef([]);

  // Sync external color picker state
  useEffect(() => {
    if (externalColorPicker) {
      setShowColorPicker(true);
    }
  }, [externalColorPicker]);

  // When color picker closes, reset external state
  useEffect(() => {
    if (!showColorPicker && externalColorPicker) {
      setExternalColorPicker(false);
    }
  }, [showColorPicker, externalColorPicker, setExternalColorPicker]);

  const shouldShowOverlay = isDrawingMode || showColorPicker;

  if (!shouldShowOverlay) return null;

  // Worklet-safe functions to be called from gesture handlers
  const updatePath = (point) => {
    pathRef.current = [...pathRef.current, point];
    setCurrentPath([...pathRef.current]);
  };

  const startPath = (point) => {
    pathRef.current = [point];
    setCurrentPath([point]);
  };

  const finishPath = () => {
    if (pathRef.current.length > 0) {
      addDrawing({
        path: pathRef.current,
        color: drawingColor,
        id: Date.now(),
      });
      pathRef.current = [];
      setCurrentPath([]);
    }
  };

  const panGesture = Gesture.Pan()
    .onStart((event) => {
      runOnJS(startPath)({ x: event.x, y: event.y });
    })
    .onUpdate((event) => {
      runOnJS(updatePath)({ x: event.x, y: event.y });
    })
    .onEnd(() => {
      runOnJS(finishPath)();
    });

  const pathToSvgPath = (points) => {
    if (points.length === 0) return '';

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  return (
    <>
      {/* Only show drawing overlay when in drawing mode */}
      {isDrawingMode && (
        <View style={styles.overlay} pointerEvents="box-none">
          <GestureDetector gesture={panGesture}>
            <Svg style={styles.svg}>
              {/* Render saved drawings */}
              {drawings.map((drawing) => (
                <Path
                  key={drawing.id}
                  d={pathToSvgPath(drawing.path)}
                  stroke={drawing.color}
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {/* Render current path being drawn */}
              {currentPath.length > 0 && (
                <Path
                  d={pathToSvgPath(currentPath)}
                  stroke={drawingColor}
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </Svg>
          </GestureDetector>

          {/* Drawing tools */}
          <View style={styles.tools}>
            {/* Color selector button */}
            <TouchableOpacity
              style={[styles.toolButton, { backgroundColor: drawingColor }]}
              onPress={() => setShowColorPicker(true)}
            >
              <Ionicons name="color-palette" size={20} color="#000" />
            </TouchableOpacity>

            {/* Clear button */}
            <TouchableOpacity
              style={styles.toolButton}
              onPress={clearDrawings}
            >
              <Ionicons name="trash" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Color Picker Modal - can show even when drawing mode is off (via long-press) */}
      <Modal
        visible={showColorPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowColorPicker(false)}
        >
          <View style={styles.colorPickerContainer}>
            <Text style={styles.colorPickerTitle}>Select Drawing Color</Text>
            <View style={styles.colorGrid}>
              {COLORS.map((color) => (
                <TouchableOpacity
                  key={color.value}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color.value },
                    drawingColor === color.value && styles.selectedColor,
                  ]}
                  onPress={() => {
                    setDrawingColor(color.value);
                    setShowColorPicker(false);
                  }}
                >
                  {drawingColor === color.value && (
                    <Ionicons name="checkmark" size={24} color="#000" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  svg: {
    flex: 1,
  },
  tools: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'column',
    gap: 8,
  },
  toolButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerContainer: {
    backgroundColor: '#262626',
    borderRadius: 12,
    padding: 20,
    minWidth: 280,
  },
  colorPickerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  colorOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedColor: {
    borderColor: '#2196F3',
    borderWidth: 4,
  },
});
