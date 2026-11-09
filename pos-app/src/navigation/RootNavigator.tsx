import React from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { SaleScreen } from '../features/sales/ui/SaleScreen';
import { SettingsScreen } from '../features/settings/ui/SettingsScreen';
import { DashboardScreen } from '../features/analytics/ui/DashboardScreen';
import { InventoryScreen } from '../features/inventory/ui/InventoryScreen';
import { OfflineBanner } from '../shared/ui/OfflineBanner';
import { Icon, type IconName } from '../shared/ui/Icon';
import { colors, fonts } from '../shared/ui/theme';

const Tab = createBottomTabNavigator();

const theme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: colors.background, card: colors.background, text: colors.ink, border: colors.line, primary: colors.action },
};

const ICONS: Record<string, IconName> = { Venta: 'venta', Inventario: 'inventario', Dashboard: 'dashboard', Ajustes: 'ajustes' };

/** Pestañas con icono y sin cabecera: cada pantalla dibuja la suya (SPEC-012 RF-3). */
export function RootNavigator() {
    return (
        <NavigationContainer theme={theme}>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarActiveTintColor: colors.action,
                    tabBarInactiveTintColor: colors.muted,
                    tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
                    tabBarIcon: ({ color, size }) => <Icon name={ICONS[route.name]} color={color} size={size + 2} />,
                })}
                screenLayout={({ children }) => (
                    <View style={{ flex: 1 }}>
                        <OfflineBanner />
                        {children}
                    </View>
                )}
            >
                <Tab.Screen name="Venta" component={SaleScreen} />
                <Tab.Screen name="Inventario" component={InventoryScreen} />
                <Tab.Screen name="Dashboard" component={DashboardScreen} />
                <Tab.Screen name="Ajustes" component={SettingsScreen} />
            </Tab.Navigator>
        </NavigationContainer>
    )
}
