/***************************************************
//Web: http://www.buydisplay.com
EastRising Technology Co.,LTD
****************************************************/
  
#ifndef _er_oled_H_
#define _er_oled_H_

#include <Arduino.h>

#define WIDTH 20
#define HEIGHT 4


#define OLED_RST  D7 
#define OLED_CS  D3


//Software SPI
//#define OLED_SDI  10
//#define OLED_SCL  11



#define COMMAND  0xf8
#define DATA     0xfa



void SPIWrite(uint8_t value,uint8_t mode) ;
void command(uint8_t cmd);
void data(uint8_t dat);
void Write_CGRAM(const uint8_t *pBmp);
void er_oled_begin();
void er_oled_clear(void);
void er_oled_set_cursor(uint8_t x,uint8_t y,uint8_t Display_direction);
void er_oled_string(uint8_t x,uint8_t y, const char * pString,uint8_t Display_direction);
void er_oled_char(uint8_t x,uint8_t y, uint8_t character,uint8_t Display_direction);
void Write_DDRAM(uint8_t a); 

void send_start_byte_write(uint8_t _data_command);
void send_start_byte_read(uint8_t _data_command);
void send_one_byte(uint8_t t);
 void OLED_Display_Turn(uint8_t dat);
 

const uint8_t cgram[]  = //
{
	0x1f,0x00,0x1f,0x00,0x1f,0x00,0x1f,0x00,
	0x00,0x1f,0x00,0x1f,0x00,0x1f,0x00,0x1f,
	0x15,0x15,0x15,0x15,0x15,0x15,0x15,0x15,
	0x0a,0x0a,0x0a,0x0a,0x0a,0x0a,0x0a,0x0a,
	0x08,0x0f,0x12,0x0f,0x0a,0x1f,0x02,0x02,	//年
	0x0f,0x09,0x0f,0x09,0x0f,0x09,0x09,0x13,	//月
	0x1f,0x11,0x11,0x1f,0x11,0x11,0x11,0x1F,	//日
	0x0C,0x0a,0x11,0x1f,0x09,0x09,0x09,0x13,	//分
};

#endif
