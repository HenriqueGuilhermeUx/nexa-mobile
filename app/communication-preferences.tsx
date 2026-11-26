import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ActionButton, Brand, Paragraph, Screen, Title } from '@/components/ui';
import { nexaApi } from '@/lib/api';
import { loadNexaSession } from '@/lib/session';
import { colors, radius, spacing } from '@/theme';

type Channel='email'|'whatsapp'|'telegram';
const CHANNELS:[Channel,string][]=[
  ['email','E-mail'],['whatsapp','WhatsApp'],['telegram','Telegram'],
];

export default function CommunicationPreferencesScreen() {
  const [original,setOriginal]=useState<Record<Channel,boolean>>({
    email:false,whatsapp:false,telegram:false,
  });
  const [selected,setSelected]=useState<Record<Channel,boolean>>({
    email:false,whatsapp:false,telegram:false,
  });
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{
    let mounted=true;
    (async()=>{
      try {
        const session=await loadNexaSession();
        if(!session){router.replace('/sign-in');return;}
        const response=await nexaApi.getCommunicationConsents(session.accessToken);
        if(!mounted)return;
        const choices={
          email:response.channels.email.granted,
          whatsapp:response.channels.whatsapp.granted,
          telegram:response.channels.telegram.granted,
        };
        setOriginal(choices);setSelected(choices);
      }catch(e){
        if(mounted)setError(e instanceof Error?e.message:'Não foi possível consultar suas preferências.');
      }finally{
        if(mounted)setLoading(false);
      }
    })();
    return()=>{mounted=false;};
  },[]);

  async function save() {
    setError('');setMessage('');
    setSaving(true);
    try{
      const session=await loadNexaSession();
      if(!session)throw new Error('Entre na sua conta novamente.');
      const changed:Partial<Record<Channel,boolean>>={};
      for(const [channel] of CHANNELS) {
        if(original[channel]!==selected[channel]) changed[channel]=selected[channel];
      }
      if(!Object.keys(changed).length){setMessage('Nenhuma alteração necessária.');return;}
      await nexaApi.updateCommunicationConsents(session.accessToken,changed);
      setOriginal({...selected});
      setMessage('Preferências atualizadas. Você pode mudar ou revogar a qualquer momento.');
    }catch(e){
      setError(e instanceof Error?e.message:'Não foi possível salvar. Nenhuma nova autorização foi presumida.');
    }finally{setSaving(false);}
  }

  return (
    <Screen>
      <Brand />
      <Title>Comunicações Nexa</Title>
      <Paragraph>
        Escolha em quais canais podemos enviar orientações, novidades e ofertas.
        Não é necessário autorizar nenhum canal para continuar usando a Nexa.
      </Paragraph>
      <View style={styles.card}>
        {CHANNELS.map(([channel,label])=>(
          <Pressable key={channel} accessibilityRole="checkbox"
            accessibilityState={{checked:selected[channel]}}
            disabled={loading||saving}
            onPress={()=>setSelected(prev=>({...prev,[channel]:!prev[channel]}))}
            style={styles.row}>
            <View style={[styles.box,selected[channel]&&styles.checked]}>
              <Text style={styles.mark}>{selected[channel]?'✓':''}</Text>
            </View>
            <Text style={styles.label}>Receber comunicações por {label}</Text>
          </Pressable>
        ))}
        <Text style={styles.note}>
          Comunicações necessárias ao serviço e alertas de segurança seguem
          regras distintas. No Telegram, é necessário vincular seu chat antes
          de qualquer envio. A autorização pode ser retirada individualmente.
        </Text>
      </View>
      <ActionButton label={loading?'Carregando...':'Salvar preferências'}
        loading={saving} disabled={loading} onPress={save}/>
      {message?<Text style={styles.success}>{message}</Text>:null}
      {error?<Text style={styles.error}>{error}</Text>:null}
    </Screen>
  );
}

const styles=StyleSheet.create({
  card:{backgroundColor:colors.panel,borderColor:colors.border,borderWidth:1,
    borderRadius:radius.md,padding:spacing.md,marginVertical:spacing.md},
  row:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12},
  box:{borderWidth:1.5,borderColor:colors.muted,width:22,height:22,
    borderRadius:5,alignItems:'center',justifyContent:'center'},
  checked:{backgroundColor:colors.primary,borderColor:colors.primary},
  mark:{color:colors.white,fontWeight:'bold'},
  label:{flex:1,color:colors.text,fontSize:14},
  note:{color:colors.muted,fontSize:12,marginTop:spacing.sm},
  success:{color:colors.success,marginTop:spacing.md},
  error:{color:colors.danger,marginTop:spacing.md},
});
