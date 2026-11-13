import React from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { SaleScreen } from '../features/sales/ui/SaleScreen';
import { SettingsScreen } from '../features/settings/ui/SettingsScreen';
import { DashboardScreen } from '../features/analytics/ui/DashboardScreen';
import { InventoryScreen } from '../features/inventory/ui/InventoryScreen';
import { RoleSelectScreen } from '../features/admin/ui/RoleSelectScreen';
import { AdminLoginScreen } from '../features/admin/ui/AdminLoginScreen';
import { AdminSalesScreen } from '../features/admin/ui/AdminSalesScreen';
import { AdminStockScreen } from '../features/admin/ui/AdminStockScreen';
import { AdminAccountScreen } from '../features/admin/ui/AdminAccountScreen';
import { useSessionStore } from '../shared/store/sessionStore';
import { OfflineBanner } from '../shared/ui/OfflineBanner';
import { Icon, type IconName } from '../shared/ui/Icon';
import { colors, fonts } from '../shared/ui/theme';

const Tab = createBottomTabNavigator();

const theme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: colors.background, card: colors.background, text: colors.ink, border: colors.line, primary: colors.action },
};

const ICONS: Record<string, IconName> = { Venta: 'venta', Inventario: 'inventario', Dashboard: 'dashboard', Ajustes: 'ajustes', Ventas: 'dashboard', Stock: 'inventario', Cuenta: 'ajustes' };

/**
 * Pantallas según el rol (SPEC-013): sin rol, la selección; vendedor, las pestañas de siempre;
 * administrador, el login o el panel. Pestañas con icono y sin cabecera (SPEC-012 RF-3).
 */
export function RootNavigator() {
    const role = useSessionStore((s) => s.role);
    const adminSession = useSessionStore((s) => s.adminSession);
    if (!role) return <RoleSelectScreen />;
    if (role === 'admin' && !adminSession) return <AdminLoginScreen />;
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
                {role === 'admin' ? (
                    <>
                        <Tab.Screen name="Ventas" component={AdminSalesScreen} />
                        <Tab.Screen name="Stock" component={AdminStockScreen} />
                        <Tab.Screen name="Cuenta" component={AdminAccountScreen} />
                    </>
                ) : (
                    <>
                        <Tab.Screen name="Venta" component={SaleScreen} />
                        <Tab.Screen name="Inventario" component={InventoryScreen} />
                        <Tab.Screen name="Dashboard" component={DashboardScreen} />
                        <Tab.Screen name="Ajustes" component={SettingsScreen} />
                    </>
                )}
            </Tab.Navigator>
        </NavigationContainer>
    )
}
