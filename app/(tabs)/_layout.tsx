import { useCallback, useState } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform, useWindowDimensions } from 'react-native';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type ProfileRole } from '@/lib/profiles';

export default function TabLayout() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 768;

  // Start from the role chosen at sign-up (stored in the session user metadata)
  // so the Events tab is available immediately for teachers, then confirm it
  // against the profiles table and refresh it whenever the app regains focus.
  const [role, setRole] = useState<ProfileRole | null>(() => {
    const metadataRole = user?.user_metadata?.role;
    return metadataRole === 'teacher' || metadataRole === 'admin'
      ? metadataRole
      : null;
  });

  // The Events tab is only registered (and visible) for teacher/admin accounts.
  // Students get a 404 if they try to navigate to /teacher directly.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      getProfile(user.id).then((profile) => {
        if (!active) return;
        if (profile) {
          setRole(profile.role);
        } else if (
          user.user_metadata?.role === 'teacher' ||
          user.user_metadata?.role === 'admin'
        ) {
          setRole(user.user_metadata.role);
        } else {
          setRole('student');
        }
      });
      return () => {
        active = false;
      };
    }, [user])
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarActiveBackgroundColor: COLORS.primarySoft,
        headerShown: false,
        headerStyle: { backgroundColor: COLORS.card },
        headerShadowVisible: false,
        headerTintColor: COLORS.textPrimary,
        tabBarLabelStyle: { fontSize: width < 360 ? 10 : 12, lineHeight: 16, fontWeight: '600' },
        tabBarIconStyle: { marginTop: 0 },
        tabBarItemStyle: {
          minHeight: 48,
          marginHorizontal: 4,
          marginVertical: 4,
          paddingVertical: 4,
          borderRadius: 8,
        },
        tabBarHideOnKeyboard: true,
        tabBarStyle: desktop
          ? {
              position: 'absolute',
              width: '100%',
              left: 0,
              bottom: 0,
              height: 68,
              borderRadius: 0,
              backgroundColor: COLORS.elevated,
              borderTopWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 32,
            }
          : {
              height: width < 360 ? 64 : 68,
              backgroundColor: COLORS.elevated,
              borderTopColor: COLORS.border,
              paddingBottom: 6,
            },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialIcons name="home" color={color} size={25} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => <MaterialIcons name="qr-code-scanner" color={color} size={25} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <MaterialIcons name="history" color={color} size={25} />,
        }}
      />
      <Tabs.Protected guard={role === 'teacher' || role === 'admin'}>
        <Tabs.Screen
          name="teacher"
          options={{
            title: 'Events',
            tabBarIcon: ({ color }) => <MaterialIcons name="event-note" color={color} size={25} />,
          }}
        />
      </Tabs.Protected>
      <Tabs.Protected guard={role === 'admin'}>
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Admin',
            tabBarIcon: ({ color }) => (
              <MaterialIcons name="admin-panel-settings" color={color} size={25} />
            ),
          }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" color={color} size={25} />,
        }}
      />
    </Tabs>
  );
}
