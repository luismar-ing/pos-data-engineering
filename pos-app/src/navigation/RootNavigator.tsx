import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';

const VentaScreen = () => <View><Text>Venta</Text></View>;
const InventarioScreen = () => <View><Text>Inventario</Text></View>;
const DashboardScreen = () => <View><Text>Dashboard</Text></View>;
const AjustesScreen = () => <View><Text>Ajustes</Text></View>;

const Tab = createBottomTabNavigator();

export function RootNavigator() {
    return (
        <NavigationContainer>
            <Tab.Navigator>
                <Tab.Screen name="Venta" component={VentaScreen} />
                <Tab.Screen name="Inventario" component={InventarioScreen} />
                <Tab.Screen name="Dashboard" component={DashboardScreen} />
                <Tab.Screen name="Ajustes" component={AjustesScreen} />
            </Tab.Navigator>
        </NavigationContainer>
    )
}