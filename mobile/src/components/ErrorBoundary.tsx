import React from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Clipboard, Alert,
} from 'react-native';

interface State { error: Error | null; info: string }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, info: '' };

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info: info.componentStack ?? '' });
  }

  copy = () => {
    const msg = `ERROR: ${this.state.error?.message}\n\nSTACK: ${this.state.error?.stack}\n\nCOMPONENT: ${this.state.info}`;
    Clipboard.setString(msg);
    Alert.alert('Copied', 'Error details copied to clipboard');
  };

  render() {
    if (!this.state.error) return this.props.children;
    const { error, info } = this.state;
    return (
      <View style={s.root}>
        <View style={s.header}>
          <Text style={s.emoji}>💥</Text>
          <Text style={s.title}>KenyaPay Crash Report</Text>
          <Text style={s.subtitle}>Show this screen to your developer</Text>
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner}>
          <Text style={s.label}>ERROR MESSAGE</Text>
          <View style={s.box}>
            <Text style={s.errorText}>{error.message}</Text>
          </View>
          <Text style={s.label}>STACK TRACE</Text>
          <View style={s.box}>
            <Text style={s.codeText}>{error.stack}</Text>
          </View>
          <Text style={s.label}>COMPONENT TREE</Text>
          <View style={s.box}>
            <Text style={s.codeText}>{info}</Text>
          </View>
        </ScrollView>
        <TouchableOpacity style={s.btn} onPress={this.copy}>
          <Text style={s.btnText}>📋 Copy Full Error Report</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff5f5' },
  header: {
    backgroundColor: '#ef4444', paddingTop: 60, paddingBottom: 24,
    paddingHorizontal: 20, alignItems: 'center',
  },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 32 },
  label: {
    fontSize: 11, fontWeight: '800', color: '#ef4444',
    letterSpacing: 1.2, marginTop: 16, marginBottom: 6,
  },
  box: {
    backgroundColor: '#1e1e2e', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#2d2d3d',
  },
  errorText: { color: '#ff6b6b', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  codeText: { color: '#a8d8a8', fontSize: 11, fontFamily: 'monospace', lineHeight: 18 },
  btn: {
    margin: 16, backgroundColor: '#ef4444', borderRadius: 14,
    padding: 16, alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
