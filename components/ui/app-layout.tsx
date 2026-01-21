import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Header } from '@/components/ui/header';
import { Sidebar, SidebarItem } from '@/components/ui/sidebar';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export type AppLayoutProps = {
  children: React.ReactNode;
  title: string;
  sidebarItems?: SidebarItem[];
  sidebarHeader?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  headerRightIcon?: React.ReactNode;
  onHeaderRightPress?: () => void;
  showHeader?: boolean;
  showSidebar?: boolean;
};

const DEFAULT_SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Home', href: '/(tabs)/(home)' },
  { label: 'Schemas', href: '/(tabs)/(schemas)' },
  { label: 'History', href: '/(tabs)/(history)' },
  { label: 'Dashboard', href: '/(tabs)/dashboard' },
];

export function AppLayout({
  children,
  title,
  sidebarItems = DEFAULT_SIDEBAR_ITEMS,
  sidebarHeader,
  sidebarFooter,
  headerRightIcon,
  onHeaderRightPress,
  showHeader = true,
  showSidebar = true,
}: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const textColor = useThemeColor({}, 'text');

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const defaultSidebarHeader = (
    <View style={styles.sidebarHeaderContent}>
      <ThemedText style={styles.sidebarTitle}>Hoppa</ThemedText>
      <ThemedText style={styles.sidebarSubtitle}>Fitness Tracker</ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      {showHeader && (
        <Header
          title={title}
          leftIcon={
            showSidebar ? (
              <SymbolView name="line.3.horizontal" size={24} tintColor={textColor} />
            ) : undefined
          }
          onLeftPress={showSidebar ? openSidebar : undefined}
          rightIcon={headerRightIcon}
          onRightPress={onHeaderRightPress}
        />
      )}

      <View style={styles.content}>{children}</View>

      {showSidebar && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={closeSidebar}
          items={sidebarItems}
          header={sidebarHeader ?? defaultSidebarHeader}
          footer={sidebarFooter}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  sidebarHeaderContent: {
    gap: 4,
  },
  sidebarTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  sidebarSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
});
