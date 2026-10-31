import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import { SaleScreen } from '../features/sales/ui/SaleScreen';
import { SettingsScreen } from '../features/settings/ui/SettingsScreen';

const InventarioScreen = () => <View><Text>Inventario</Text></View>;
const DashboardScreen = () => <View><Text>Dashboard</Text></View>;

const Tab = createBottomTabNavigator();

export function RootNavigator() {
    return (
        <NavigationContainer>
            <Tab.Navigator>
                <Tab.Screen name="Venta" component={SaleScreen} />
                <Tab.Screen name="Inventario" component={InventarioScreen} />
                <Tab.Screen name="Dashboard" component={DashboardScreen} />
                <Tab.Screen name="Ajustes" component={SettingsScreen} />
            </Tab.Navigator>
        </NavigationContainer>
    )
}