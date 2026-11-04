import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { SaleScreen } from '../features/sales/ui/SaleScreen';
import { SettingsScreen } from '../features/settings/ui/SettingsScreen';
import { DashboardScreen } from '../features/analytics/ui/DashboardScreen';
import { InventoryScreen } from '../features/inventory/ui/InventoryScreen';
import { OfflineBanner } from '../shared/ui/OfflineBanner';

const Tab = createBottomTabNavigator();

export function RootNavigator() {
    return (
        <NavigationContainer>
            <Tab.Navigator
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