import React, { useRef, useState, useEffect } from 'react';
import { Box, Center, Loader, Text, Group } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let currentY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at top of scroll
      if (container.scrollTop === 0) {
        setStartY(e.touches[0].clientY);
        setIsDragging(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;

      currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      // Only allow pulling down, not up
      if (diff > 0 && container.scrollTop === 0) {
        e.preventDefault();
        // Add resistance
        const resistance = 0.4;
        const distance = Math.min(diff * resistance, threshold * 1.5);
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (!isDragging) return;

      setIsDragging(false);

      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold);

        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, pullDistance, threshold, isRefreshing, onRefresh]);

  const pullProgress = Math.min(pullDistance / threshold, 1);
  const rotation = pullProgress * 360;

  return (
    <Box
      ref={containerRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Pull indicator */}
      <Box
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${pullDistance}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Center>
          {isRefreshing ? (
            <Group gap="sm">
              <Loader size="sm" color="blue" />
              <Text size="sm" c="dimmed">Refreshing...</Text>
            </Group>
          ) : pullDistance > 0 ? (
            <Group gap="sm">
              <IconRefresh
                size={20}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.3s',
                  color: pullProgress >= 1 ? '#228be6' : '#868e96',
                }}
              />
              <Text size="sm" c="dimmed">
                {pullProgress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
              </Text>
            </Group>
          ) : null}
        </Center>
      </Box>

      {/* Content */}
      <Box style={{ transform: `translateY(${pullDistance}px)` }}>
        {children}
      </Box>
    </Box>
  );
}
